import {
  json as jsonBodyParser,
  urlencoded as urlencodedBodyParser,
} from "body-parser";
import products from "controllers/products";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { middleware as openApiValidator } from "express-openapi-validator";
import path from "path";
import { Pool } from "pg";
import { migrate } from "postgres-migrations";
import createApiRoutes from "routes/index";
import createAuthService, { HttpError } from "services/auth";
import createProductService from "services/products";

export type AppConfig = {
  dev?: boolean;
  tenantId: string;
  clientId: string;
  connectionString: string;
  openIdUrl?: string;
};

export default async ({
  dev = false,
  tenantId,
  clientId,
  connectionString,
  openIdUrl = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
}: AppConfig): Promise<express.Express> => {
  // Database
  const databaseClient = await createDatabaseConnection(connectionString, {
    printMigrations: true,
  });

  // Controllers
  const authHelper = await createAuthService(openIdUrl, clientId);
  const productService = createProductService(databaseClient);

  const controllers = {
    ...products(authHelper, productService),
  };

  const routes = createApiRoutes(controllers);

  // App
  const app = express();
  app.use(temporaryLogger({ dev }));
  app.use(cors());
  app.use(urlencodedBodyParser({ extended: false }));
  app.use(jsonBodyParser());
  app.use(openApiValidator({ apiSpec: "openapi/api.yaml" }));
  app.use("/", routes);
  app.use(errorHandler({ dev }));
  return app;
};

type EnvConfigType = AppConfig & { port: number };

export const environmentConfig = (): EnvConfigType => {
  const requiredEnv = (name: string): string => {
    const value = process.env[name];
    if (value == null) {
      throw new Error(`Missing required environment variable ${name}`);
    }
    return value;
  };
  const requiredEnvWithDefault = (name: string, defaultVal: string): string => {
    const value = process.env[name];
    if (value == null) {
      return defaultVal;
    }
    return value;
  };
  const optionalEnv = (name: string): string | undefined => {
    const value = process.env[name];
    if (value == null || value == "") {
      return undefined;
    }
    return value;
  };

  dotenv.config();
  if ((optionalEnv("PRINT_ENV") ?? "missing") == "true") {
    console.log(`${JSON.stringify(process.env)}`);
  }

  // Server
  const port = Number.parseInt(requiredEnvWithDefault("PORT", "8000"), 10);
  const dev = optionalEnv("NODE_ENV") === "development";

  // Auth
  const tenantId = requiredEnv("TENANT_ID");
  const clientId = requiredEnv("AAD_CLIENT_ID");

  // Secrets
  const connectionString = requiredEnv("DB_CONNECTION_STRING");

  return {
    dev,
    tenantId,
    clientId,
    connectionString,
    port,
  };
};

/**
 * createDatabaseConnection
 * Creates a database connection pool
 * and runs database migrations from ./migrations.
 *
 * `connectionString` should be a valid postgres connection string.
 * Example: `postgresql://postgres:example@127.0.0.1:5432/postgres`
 */
export const createDatabaseConnection = async (
  connectionString: string,
  { printMigrations = false } = {}
): Promise<Pool> => {
  const client = new Pool({ connectionString });
  const migrations = await migrate(
    { client },
    path.resolve(process.cwd(), "./migrations")
  );
  if (printMigrations) {
    console.log(migrations);
  }
  return client;
};

const cors = () => {
  return function corsHandler(req: Request, res: Response, next: NextFunction) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Accept", "application/json, text/plain, */*");
    res.header(
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Origin, Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === "OPTIONS") {
      res.header(
        "Access-Control-Allow-Methods",
        "PUT, POST, PATCH, DELETE, GET"
      );
      return res.sendStatus(200);
    }
    next();
  };
};

const temporaryLogger = ({ dev } = { dev: false }) => {
  return function temporaryLoggerHandler(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const start = new Date();
    console.log(
      `[${start.toISOString()}] ${req.method} ${req.url}${
        !dev ? `` : `\n  ${JSON.stringify(req.headers)}`
      }`
    );
    res.once("finish", function temporaryLoggerResponseFinish(error: Error) {
      if (error != null) {
        console.log(error);
        return;
      }
      const end = new Date();
      const duration = end.getUTCMilliseconds() - start.getUTCMilliseconds();
      const headers = JSON.stringify(res.getHeaders());
      console.log(
        `[${end.toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${
          res.statusMessage
        }) ${duration}ms${!dev ? `` : `\n  ${headers}`}`
      );
    });
    next();
  };
};

const errorHandler = ({ dev } = { dev: false }) => {
  return function errorHandlerHandler(
    error: HttpError,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    console.error(error);

    if (res.headersSent) {
      return next(error);
    }

    const message = !dev ? error.message : error.stack;
    res.status(error.status ?? 500);
    res.json({
      error: {
        message,
      },
    });
  };
};
