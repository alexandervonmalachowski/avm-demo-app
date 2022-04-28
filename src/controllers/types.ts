/* eslint-disable @typescript-eslint/no-namespace */
import { paths } from "../openapi/types";

/**
 * Controller type
 *
 * Relates a path string to the openApi specification, and require conformance.
 * This is the main type in the file, and it's "just" an object with a
 * `Path` key which value is `PathMethodHandlers`.
 *
 * Example:
 * A Controller for a Path may end up looking something like this.
 * ```
 * {
 *  [Path]: {
 *    get: (params: Params.Get<Path>) => Resp.Get<Path>;
 *    post: (params: Params.Post<Path>) => Resp.Post<Path>;
 *  }
 * }
 * ```
 * Notice that all the http method specified for the Path are required, and all
 * other methods are missing from the resulting type.
 */
export type Controller<Path extends keyof paths> = {
  // Key: Required to have a path property which match a path
  // Value: Required to implement all the defined methods
  [P in Path]: PathMethodHandlers<P>;
};

/**
 * API type
 *
 * Same structure as a `Controller`, but requires _all_ paths to be included.
 *
 * Example:
 * ```
 * {
 *  [Path1]: {
 *    post: (params: Params.Post<Path>) => Resp.Post<Path>;
 *  },
 *  [Path2]: {
 *    get: (params: Params.Get<Path>) => Resp.Get<Path>;
 *  }
 *  ...
 * }
 * ```
 */
export type API = {
  [P in keyof paths]: PathMethodHandlers<P>;
};

/**
 * PathMethodHandlers type
 *
 * Defines all of the http handler methods (`get`,`post`...) required by the specification.
 * The handlers are defined as a function of `(params: Params<M>) => Resp<M>`.
 * Where `M` is pseudo code for "a http method that should be handled".
 *
 * Example where `get` and `post` methods are handled.
 * ```
 * {
 *   get(params: Params<M>): Resp<M>;
 *   post(params: Params<M>): Resp<M>;
 * }
 * ```
 */
export type PathMethodHandlers<Path extends keyof paths> = {
  // Almost like this, but with type checks for the `any`:s
  // ```
  // [Method in keyof HttpMethods<Path>]: (params: any) => any;
  // ```
  [Method in keyof HttpMethods<Path>]: (
    params: Params<HttpMethods<Path>[Method]>
  ) => Resp<HttpMethods<Path>[Method]>;
};
export type HttpMethods<Path extends keyof paths> = paths[Path];

// Helpers (extracts indexed access types)
// Defaults to `never` to disallow later usage of non existing types.
type _Get<T> = "get" extends keyof T ? T["get"] : never;
type _Put<T> = "put" extends keyof T ? T["put"] : never;
type _Post<T> = "post" extends keyof T ? T["post"] : never;
type _Delete<T> = "delete" extends keyof T ? T["delete"] : never;
type _Options<T> = "options" extends keyof T ? T["options"] : never;
type _Head<T> = "head" extends keyof T ? T["head"] : never;
type _Patch<T> = "patch" extends keyof T ? T["patch"] : never;
type _Trace<T> = "trace" extends keyof T ? T["trace"] : never;

// Accepted headers
type Headers = {
  header?: {
    "content-type"?: string;
    accept?: string;
    authorization?: string;
  };
};
// Internal Params helpers (extracts indexed access types)
// These needs to default to `unknown` to enable type unions in later steps.
type Parameters<HttpMethod> = "parameters" extends keyof HttpMethod
  ? HttpMethod["parameters"]
  : unknown;
type RequestBody<HttpMethod> = "requestBody" extends keyof HttpMethod
  ? { requestBody: HttpMethod["requestBody"] }
  : unknown;

/**
 * `Params` is a type derived from the openapi parameters for any `HttpMethod`
 *
 * Union of
 * - `Headers`
 * - "parameters" from the openapi specification
 * - "requestBody" from the openapi specification
 * in a controller friendly way.
 *
 * `Params` is also a namespace with aliases of `Params` for all http methods,
 * generic over a `Path`.
 */
export type Params<HttpMethod> = Headers &
  Parameters<HttpMethod> &
  RequestBody<HttpMethod>;
export namespace Params {
  /** GetParams for the path */
  export type Get<Path extends keyof paths> = Params<_Get<HttpMethods<Path>>>;

  /** PutParams for the path */
  export type Put<Path extends keyof paths> = Params<_Put<HttpMethods<Path>>>;

  /** PostParams for the path */
  export type Post<Path extends keyof paths> = Params<_Post<HttpMethods<Path>>>;

  /** DeleteParams for the path */
  export type Delete<Path extends keyof paths> = Params<
    _Delete<HttpMethods<Path>>
  >;

  /** OptionsParams for the path */
  export type Options<Path extends keyof paths> = Params<
    _Options<HttpMethods<Path>>
  >;

  /** HeadParams for the path */
  export type Head<Path extends keyof paths> = Params<_Head<HttpMethods<Path>>>;

  /** PatchParams for the path */
  export type Patch<Path extends keyof paths> = Params<
    _Patch<HttpMethods<Path>>
  >;

  /** TraceParams for the path */
  export type Trace<Path extends keyof paths> = Params<
    _Trace<HttpMethods<Path>>
  >;
}

/**
 * `Resp` is a type derived from the openapi response for any `HttpMethod`
 *
 * Wraps the openapi specification in a controller friendly way.
 *
 * `Resp` is also a namespace with aliases of `Resp` for all http methods,
 * generic over a `Path`.
 */
export type Resp<HttpMethod> = "responses" extends keyof HttpMethod
  ? Promise<Partial<HttpMethod["responses"]>>
  : never;
export namespace Resp {
  /** PutResp for the path */
  export type Put<Path extends keyof paths> = Resp<_Put<HttpMethods<Path>>>;

  /** GetResp for the path */
  export type Get<Path extends keyof paths> = Resp<_Get<HttpMethods<Path>>>;

  /** PostResp for the path */
  export type Post<Path extends keyof paths> = Resp<_Post<HttpMethods<Path>>>;

  /** DeleteResp for the path */
  export type Delete<Path extends keyof paths> = Resp<
    _Delete<HttpMethods<Path>>
  >;

  /** OptionsResp for the path */
  export type Options<Path extends keyof paths> = Resp<
    _Options<HttpMethods<Path>>
  >;

  /** HeadResp for the path */
  export type Head<Path extends keyof paths> = Resp<_Head<HttpMethods<Path>>>;

  /** PatchResp for the path */
  export type Patch<Path extends keyof paths> = Resp<_Patch<HttpMethods<Path>>>;

  /** TraceResp for the path */
  export type Trace<Path extends keyof paths> = Resp<_Trace<HttpMethods<Path>>>;
}
