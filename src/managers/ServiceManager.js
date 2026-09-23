import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Error de validación: se lanza cuando los datos de un servicio no son válidos.
 * El router lo traduce a una respuesta HTTP 400.
 */
export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

/** Campos obligatorios para crear un servicio. */
const REQUIRED_FIELDS = ["name", "description", "category", "price", "duration"];

/** Campos que el cliente puede enviar (el id nunca se acepta desde el body). */
const ALLOWED_FIELDS = [...REQUIRED_FIELDS, "available"];

/** Reglas de tipo para cada campo permitido. */
const FIELD_RULES = {
  name: {
    isValid: (v) => typeof v === "string" && v.trim().length > 0,
    message: "name debe ser un texto no vacío",
  },
  description: {
    isValid: (v) => typeof v === "string" && v.trim().length > 0,
    message: "description debe ser un texto no vacío",
  },
  category: {
    isValid: (v) => typeof v === "string" && v.trim().length > 0,
    message: "category debe ser un texto no vacío",
  },
  price: {
    isValid: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
    message: "price debe ser un número mayor o igual a 0",
  },
  duration: {
    isValid: (v) => Number.isInteger(v) && v > 0,
    message: "duration debe ser un número entero de minutos mayor a 0",
  },
  available: {
    isValid: (v) => typeof v === "boolean",
    message: "available debe ser true o false",
  },
};

const isMissing = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");

/**
 * ServiceManager: concentra toda la lógica del recurso "services"
 * (lectura, filtros, validación, generación de id y persistencia en archivo JSON).
 */
export default class ServiceManager {
  #path;
  #writeQueue = Promise.resolve();

  constructor(filePath) {
    if (!filePath) throw new Error("ServiceManager requiere la ruta del archivo de persistencia");
    this.#path = filePath;
  }

  // ---------- Persistencia ----------

  async #readServices() {
    try {
      const content = await fs.readFile(this.#path, "utf-8");
      const data = content.trim() ? JSON.parse(content) : [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.code === "ENOENT") {
        await this.#writeServices([]);
        return [];
      }
      throw error;
    }
  }

  async #writeServices(services) {
    await fs.mkdir(path.dirname(this.#path), { recursive: true });
    await fs.writeFile(this.#path, JSON.stringify(services, null, 2), "utf-8");
  }

  /**
   * Ejecuta las operaciones de escritura en serie para evitar que dos
   * peticiones simultáneas se pisen al modificar el archivo.
   */
  #enqueue(task) {
    const run = this.#writeQueue.then(task, task);
    this.#writeQueue = run.catch(() => {});
    return run;
  }

  // ---------- Validación ----------

  /** Toma solo los campos permitidos del body (descarta id y campos desconocidos). */
  #pickAllowed(data = {}) {
    const picked = {};
    for (const field of ALLOWED_FIELDS) {
      if (Object.hasOwn(data, field)) picked[field] = data[field];
    }
    return picked;
  }

  /** Valida el tipo de cada campo presente y normaliza los textos. */
  #validateTypes(data) {
    const errors = [];
    for (const [field, value] of Object.entries(data)) {
      if (!FIELD_RULES[field].isValid(value)) errors.push(FIELD_RULES[field].message);
    }
    if (errors.length) throw new ValidationError("Datos inválidos", errors);

    const normalized = { ...data };
    for (const field of ["name", "description"]) {
      if (normalized[field] !== undefined) normalized[field] = normalized[field].trim();
    }
    if (normalized.category !== undefined) {
      normalized.category = normalized.category.trim().toLowerCase();
    }
    return normalized;
  }

  // ---------- Operaciones públicas ----------

  /**
   * Devuelve todos los servicios, aplicando filtros opcionales.
   * @param {{ category?: string, available?: boolean }} filters
   */
  async getServices(filters = {}) {
    let services = await this.#readServices();

    if (filters.category !== undefined) {
      const category = String(filters.category).trim().toLowerCase();
      services = services.filter((s) => String(s.category).toLowerCase() === category);
    }
    if (filters.available !== undefined) {
      services = services.filter((s) => s.available === filters.available);
    }
    return services;
  }

  /** Devuelve el servicio con el id indicado o null si no existe. */
  async getServiceById(id) {
    const services = await this.#readServices();
    return services.find((s) => s.id === id) ?? null;
  }

  /**
   * Crea un servicio. El id se genera internamente con crypto.randomUUID();
   * cualquier id enviado en el body se ignora.
   */
  async addService(data) {
    const payload = this.#pickAllowed(data);

    const missing = REQUIRED_FIELDS.filter((field) => isMissing(payload[field]));
    if (missing.length) {
      throw new ValidationError(`Faltan campos obligatorios: ${missing.join(", ")}`, missing);
    }

    const valid = this.#validateTypes(payload);

    return this.#enqueue(async () => {
      const services = await this.#readServices();
      const newService = {
        id: crypto.randomUUID(),
        name: valid.name,
        description: valid.description,
        category: valid.category,
        price: valid.price,
        duration: valid.duration,
        available: valid.available ?? true,
      };
      services.push(newService);
      await this.#writeServices(services);
      return newService;
    });
  }

  /**
   * Actualiza un servicio existente. El id nunca se modifica.
   * Devuelve el servicio actualizado o null si no existe.
   */
  async updateService(id, data) {
    const payload = this.#pickAllowed(data);

    if (Object.keys(payload).length === 0) {
      throw new ValidationError(
        `Debe enviar al menos un campo a actualizar: ${ALLOWED_FIELDS.join(", ")}`,
        ALLOWED_FIELDS
      );
    }

    const nulls = Object.keys(payload).filter((field) => isMissing(payload[field]));
    if (nulls.length) {
      throw new ValidationError(`Los siguientes campos no pueden estar vacíos: ${nulls.join(", ")}`, nulls);
    }

    const valid = this.#validateTypes(payload);

    return this.#enqueue(async () => {
      const services = await this.#readServices();
      const index = services.findIndex((s) => s.id === id);
      if (index === -1) return null;

      // Se conserva el id original aunque el body intente cambiarlo
      services[index] = { ...services[index], ...valid, id: services[index].id };
      await this.#writeServices(services);
      return services[index];
    });
  }

  /** Elimina un servicio. Devuelve el servicio eliminado o null si no existe. */
  async deleteService(id) {
    return this.#enqueue(async () => {
      const services = await this.#readServices();
      const index = services.findIndex((s) => s.id === id);
      if (index === -1) return null;

      const [deleted] = services.splice(index, 1);
      await this.#writeServices(services);
      return deleted;
    });
  }
}
