/* eslint-disable @typescript-eslint/no-explicit-any */
import { API } from "controllers/types";
import { RequestHandler, Router } from "express";
import { HttpError } from "services/auth";

export default (controllers: API): Router => {
  const router = Router();

  // List all http methods supported by openapi
  // https://swagger.io/specification/#path-item-object
  const httpMethods = [
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
  ];

  let registrationLog = `> Registering controllers...\n`;

  // Register all the controllers
  Object.entries(controllers).forEach(async ([p, c]) => {
    const path = expressPath(p);

    registrationLog += `>   ${path}\n`;

    // Register all the http methods
    httpMethods.forEach((method) => {
      if (!(method in c && method in router)) {
        return;
      }

      // Create the handler
      const requestHandler: RequestHandler = async (req, res, next) => {
        // Parameters are already validated, but not in correct structure
        const pathParams = (req as any)?.openapi?.pathParams ?? req.params;

        // Expose always expected headers.
        // Default `content-type` and `accept` to `application/json`.
        const contentType = req.header("Content-Type") ?? "application/json";
        const accept = req.header("Accept") ?? "application/json";
        const authorization = req.header("Authorization");
        const reqHeaders = {
          ...req.headers,
          "content-type": contentType,
          accept: accept,
          authorization: authorization,
        };

        // Always add `requestBody` parameter
        // Even if not expected by openapi specification.
        // Controller ignores the parameter if not expected.
        const contentBody = { content: { [contentType]: req.body } };

        const parameters = {
          path: pathParams,
          query: req.query,
          header: reqHeaders,
          requestBody: contentBody,
        };

        // Call the controller
        let result;
        try {
          result = await (c as any)[method](parameters as any);
        } catch (err) {
          return next(err);
        }

        // Validate result
        const resultKeys = Object.keys(result);
        if (resultKeys.length != 1) {
          next(multipleStatusCodesError);
        }
        if (resultKeys[0] == "default") {
          next(defaultStatusCodeError);
        }

        // Send result
        const statusCodeKey = resultKeys[0];
        const content = (result as any)[statusCodeKey]?.content;
        const acceptable = req.accepts(Object.keys(content));
        if (acceptable) {
          const body = content[acceptable];
          const statusCodeNumber = statusCode(statusCodeKey);
          if (acceptable != jsonMime) {
            // Client does not accept json, send object anyway
            res.status(statusCodeNumber).send(body);
          } else if (statusCodeNumber >= 400 && body?.error instanceof Error) {
            // Fix json serialization of `Error`.
            // Turn `{ error: Error }`
            // into `{ error: { message: string } }`
            // where json serialization just works.
            res.status(statusCodeNumber).json({
              error: { message: body.error.message },
            });
          } else {
            // Standard response
            res.status(statusCodeNumber).json(body);
          }
        }
      };

      // Register the handler, for the method, in the router.
      // Much like this, for each combination.
      // ```
      // router.get("/v1/product/:productNo", async (req, res) => {
      //   const result = await c.get(req.params as any);
      //   res.status(200).send(result);
      // });
      // ```
      (router as any)[method](path, requestHandler);

      registrationLog += `>     ${method}\n`;
    });
  });

  registrationLog += `>`;

  console.log(registrationLog);

  return router;
};

const expressPath = (openApiPath: string): string => {
  const re = /\{([A-Za-z0-9_]+)\}/g;
  return openApiPath.replace(re, ":$1");
};

const statusCode = (statusCodeKey: string): number => {
  const statusCodeNumber = Number.parseInt(statusCodeKey);
  let statusCode = 500;
  if (!Number.isNaN(statusCodeNumber)) {
    statusCode = statusCodeNumber;
  }
  return statusCode;
};

const jsonMime = "application/json";

const multipleStatusCodesError = new HttpError(
  500,
  "Attempted to respond with multiple response statuses"
);
const defaultStatusCodeError = new HttpError(
  500,
  `Used "default" response status`
);
