/* eslint-disable @typescript-eslint/no-explicit-any */

export type AuthenticatedUser = {
  adId: string;
  email: string;
  name: string;
};

// Default service result
export type OkResult<T> = { status: "OK"; value: T };
export type CreatedResult<T> = { status: "CREATED"; value: T };
export type BadRequestResult = { status: "BAD_REQUEST"; error: Error };
export type UnauthorizedResult = { status: "UNAUTHORIZED"; error?: Error };
export type NotFoundResult = { status: "NOT_FOUND" };
// UnexpectedErrorResult is represented by `throw new Error`

// Default service result unions
export type DefaultResult<T> =
  | OkResult<T>
  | BadRequestResult
  | UnauthorizedResult
  | NotFoundResult;

export type DefaultListResult<T> =
  | OkResult<T[]>
  | BadRequestResult
  | UnauthorizedResult;

export type DefaultPaginatedListResult<T> =
  | OkResult<{
      items: T[];
      totalItems: number;
      pageNumber: number;
      pageSize: number;
    }>
  | BadRequestResult
  | UnauthorizedResult;

export type DefaultCreateResult<T> =
  | CreatedResult<T>
  | BadRequestResult
  | UnauthorizedResult;

// Helper type, prepend `AuthenticatedUser` argument to all service functions
type PrependUserParameter<Fn extends (...arg: any) => any> = Fn extends (
  ...arg: infer P
) => infer R
  ? (user: AuthenticatedUser, ...arg: P) => R
  : never;

export type WithAuthenticatedUser<Type> = {
  [Property in keyof Type]: Type[Property] extends (...args: any) => any
    ? PrependUserParameter<Type[Property]>
    : never;
};
