export const success = (body: any) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});
export const error = (statusCode: number, errorMessage: string) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify({
    error: errorMessage
  })
});
