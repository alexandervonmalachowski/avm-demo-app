/* eslint-disable @typescript-eslint/no-unused-vars */
import { components } from "openapi/types";
import { Pool } from "pg";

import { AuthenticatedUser, WithAuthenticatedUser } from "./types";

export type Product = components["schemas"]["Product"];
export type ProductSearch = components["schemas"]["ProductSearch"];
export type SearchParams = { size?: number; page?: number } & (
  | { terms: string[] }
  | { productName: string }
);

// Output
type OkResult<T> = {
  status: "OK";
  value: T;
};
type NotFoundResult = {
  status: "NOT_FOUND";
};

type ErrorResult = {
  status: "ERROR";
  error: Error;
};

export type Result<T> = OkResult<T> | NotFoundResult | ErrorResult;
// Service
type ProductServiceWithoutUser = {
  getProductById(productId: string): Promise<Result<Product>>;
  searchProducts(searchParams: SearchParams): Promise<ProductSearch>;
};
export type ProductService = WithAuthenticatedUser<ProductServiceWithoutUser>;

export default (databaseConnection: Pool): ProductService => {
  const getProductById = (
    user: AuthenticatedUser,
    productId: string
  ): Promise<Result<Product>> => {
    throw new Error("Not implemented");
  };
  const searchProducts = (
    user: AuthenticatedUser,
    searchParams: SearchParams
  ): Promise<ProductSearch> => {
    throw new Error("Not implemented");
  };
  return {
    getProductById,
    searchProducts,
  };
};
