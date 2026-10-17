function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const candidateStatus = Number(error.statusCode || error.status);
  const statusCode = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus < 600
    ? candidateStatus
    : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal server error" : error.message
  });
}

module.exports = errorHandler;
