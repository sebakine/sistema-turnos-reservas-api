import express from "express";
import servicesRouter from "./routes/services.router.js";

const app = express();

// Middlewares para leer el body de las peticiones (JSON y formularios)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de bienvenida
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API del Sistema Backend de Turnos y Reservas",
    endpoints: "/api/services",
  });
});

// Router del recurso services (toda la lógica vive en ServiceManager)
app.use("/api/services", servicesRouter);

// Rutas inexistentes
app.use((req, res) => {
  res.status(404).json({ status: "error", error: `Ruta ${req.method} ${req.originalUrl} no encontrada` });
});

// Manejador global de errores
app.use((error, req, res, next) => {
  // JSON mal formado en el body
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ status: "error", error: "El body no es un JSON válido" });
  }
  console.error(error);
  return res.status(500).json({ status: "error", error: "Error interno del servidor" });
});

export default app;
