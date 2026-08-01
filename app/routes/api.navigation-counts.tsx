import {
  getNavigationCounts,
} from "../lib/navigation-counts.server";

export async function loader({
  request,
}: {
  request: Request;
}) {
  const counts =
    await getNavigationCounts(request);

  return Response.json(counts, {
    headers: {
      "Cache-Control":
        "private, no-store, max-age=0",
    },
  });
}