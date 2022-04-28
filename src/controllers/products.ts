import { AuthService } from "services/auth";
import { ProductService } from "services/products";

import {
  badRequestJSONResponse,
  notFoundJSONResponse,
  okJSONResponse,
} from "./http";
import { Controller, Params, Resp } from "./types";

// Name the path constant type
type Path = typeof path;
type PathId = typeof pathId;

// Implementation
const path = "/v1/product";
const pathId = "/v1/product/{productId}";
export default (
  authService: AuthService,
  productService: ProductService
): Controller<Path | PathId> => {
  return {
    [path]: {
      async get(parameters: Params.Get<Path>): Resp.Get<Path> {
        const user = authService.requireUser(parameters.header);
        const { productName, terms } = parameters.query;

        if (productName != null) {
          const { items } = await productService.searchProducts(user, {
            productName,
            terms,
          });
          return okJSONResponse({ items });
        }

        if (terms != null) {
          const { items } = await productService.searchProducts(user, {
            terms,
          });
          return okJSONResponse({ items });
        }

        return badRequestJSONResponse({
          error: { message: "At least one query parameter must be provided" },
        });
      },
    },
    [pathId]: {
      async get(parameters: Params.Get<PathId>): Resp.Get<PathId> {
        const user = authService.requireUser(parameters.header);
        const productId = parameters.path.productId;
        if (!productId) {
          return badRequestJSONResponse({
            error: { message: "Missing input: productId" },
          });
        }
        const productRes = await productService.getProductById(user, productId);
        switch (productRes.status) {
          case "NOT_FOUND":
            return notFoundJSONResponse({ error: { message: "Not found" } });
          case "ERROR":
            throw productRes.error;
          case "OK":
            return okJSONResponse(productRes.value);
        }
      },
    },
  };
};
