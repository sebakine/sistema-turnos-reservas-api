import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Carga las variables definidas en el archivo .env (si existe) dentro de process.env
dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

const port = Number.parseInt(process.env.PORT, 10);

const envConfig = {
  // Puerto en el que escucha el servidor. Si no viene en .env se usa 8080.
  PORT: Number.isInteger(port) && port > 0 ? port : 8080,
  // Ruta del archivo JSON donde el ServiceManager persiste los servicios.
  SERVICES_FILE: path.resolve(
    ROOT_DIR,
    process.env.SERVICES_FILE || "src/data/services.json"
  ),
};

export default envConfig;
