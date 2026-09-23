import { Router } from "express";
import ServiceManager, { ValidationError } from "../managers/ServiceManager.js";
import envConfig from "../config/env.config.js";

const router = Router();
const serviceManager = new ServiceManager(envConfig.SERVICES_FILE);

/**
 * Traduce los errores del ServiceManager a respuestas HTTP.
 * Los errores de validación se responden con 400; el resto pasa al manejador global (500).
 */
const handleError = (error, res, next) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ status: "error", error: error.message, details: error.details });
  }
  return next(error);
};

// GET /api/services  -> lista todos los servicios (filtros opcionales por req.query)
router.get("/", async (req, res, next) => {
  try {
    const { category, available } = req.query;
    const filters = {};

    if (category !== undefined) {
      if (typeof category !== "string" || category.trim() === "") {
        return res.status(400).json({ status: "error", error: "El filtro category debe ser un texto no vacío" });
      }
      filters.category = category;
    }

    if (available !== undefined) {
      if (available !== "true" && available !== "false") {
        return res.status(400).json({ status: "error", error: "El filtro available solo acepta true o false" });
      }
      filters.available = available === "true";
    }

    const services = await serviceManager.getServices(filters);
    return res.status(200).json({ status: "success", count: services.length, payload: services });
  } catch (error) {
    return handleError(error, res, next);
  }
});

// GET /api/services/:sid  -> devuelve un servicio por id (req.params)
router.get("/:sid", async (req, res, next) => {
  try {
    const { sid } = req.params;
    const service = await serviceManager.getServiceById(sid);

    if (!service) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }
    return res.status(200).json({ status: "success", payload: service });
  } catch (error) {
    return handleError(error, res, next);
  }
});

// POST /api/services  -> crea un servicio con los datos de req.body (id autogenerado)
router.post("/", async (req, res, next) => {
  try {
    const data = req.body ?? {};
    const newService = await serviceManager.addService(data);
    return res.status(201).json({ status: "success", message: "Servicio creado", payload: newService });
  } catch (error) {
    return handleError(error, res, next);
  }
});

// PUT /api/services/:sid  -> actualiza un servicio con req.body (el id no se modifica)
router.put("/:sid", async (req, res, next) => {
  try {
    const { sid } = req.params;
    const data = req.body ?? {};
    const updated = await serviceManager.updateService(sid, data);

    if (!updated) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }
    return res.status(200).json({ status: "success", message: "Servicio actualizado", payload: updated });
  } catch (error) {
    return handleError(error, res, next);
  }
});

// DELETE /api/services/:sid  -> elimina un servicio por id (req.params)
router.delete("/:sid", async (req, res, next) => {
  try {
    const { sid } = req.params;
    const deleted = await serviceManager.deleteService(sid);

    if (!deleted) {
      return res.status(404).json({ status: "error", error: `No existe un servicio con id ${sid}` });
    }
    return res.status(200).json({ status: "success", message: "Servicio eliminado", payload: deleted });
  } catch (error) {
    return handleError(error, res, next);
  }
});

export default router;
