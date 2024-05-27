export let success = function (message: any, data?: any, code?: Number) {
  return {
    msg: message ?? "Success",
    data: data ?? "Data May Be Empty ...",
    code: code ?? 200,
    error: false,
  };
};

export let error = function (message: any, error?: any, code: Number = 400) {
  console.log(error);

  return {
    msg: message ?? "SomeThing Went Wrong !",
    data: error,
    code,
    error: true,
  };
};

export let validation = function (code: Number = 403) {
  return {
    msg: "Bad Request !",
    code,
    error: true,
  };
};
