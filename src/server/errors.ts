export class BaseHTTPError extends Error {
  status: number;
  message: string;

  constructor(status = 500, message = "Internal Server Error") {
    super(`${status}: ${message}`);

    this.status = status;
    this.message = message;
  }
}

export class BadRequestError extends BaseHTTPError {
  constructor(reason: string) {
    super(400, reason);
  }
}

export class SiteNotFoundError extends BadRequestError {
  constructor(site: string) {
    super(`Unknown site ${site}`);
  }
}

export class MissingParameterError extends BadRequestError {
  constructor(param: string) {
    super(`Missing parameters: ${param}`);
  }
}

export class NotFoundError extends BaseHTTPError {
  constructor(what: string) {
    super(404, `Not found: ${what}`);
  }
}

export class InternalServerError extends BaseHTTPError {
  constructor(reason: string) {
    super(500, reason);
  }
}


