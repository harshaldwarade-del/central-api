class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

const sendResponse = (res, statusCode, data, message) => {
  return res
    .status(statusCode)
    .json(new ApiResponse(statusCode, data, message));
};

module.exports = { ApiResponse, sendResponse };
