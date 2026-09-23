import app from "./app.js";
import envConfig from "./config/env.config.js";

const { PORT } = envConfig;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
