class AppError extends Error {
  constructor(code, message, details, status = 400) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function toErrorPayload(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details || null
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error.",
        details: null
      }
    }
  };
}

module.exports = {
  AppError,
  toErrorPayload
};
