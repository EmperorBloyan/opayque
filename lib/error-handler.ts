export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: any) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return Response.json(
      { 
        success: false, 
        error: error.message,
        code: error.code 
      },
      { status: error.statusCode }
    );
  }

  // Default safe error
  return Response.json(
    { 
      success: false, 
      error: "An unexpected error occurred" 
    },
    { status: 500 }
  );
}

// Common payment errors
export const PaymentErrors = {
  INSUFFICIENT_FUNDS: new AppError("Insufficient funds", 400, "INSUFFICIENT_FUNDS"),
  TX_FAILED: new AppError("Transaction failed", 400, "TX_FAILED"),
  INVALID_AMOUNT: new AppError("Invalid amount", 400, "INVALID_AMOUNT"),
  SHIELDED_FAILED: new AppError("Shielded payment failed", 500, "SHIELDED_FAILED"),
};
