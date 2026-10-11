import { operatorOpenApi } from "@/lib/operator-api/openapi";

export async function GET() {
  return Response.json(operatorOpenApi);
}
