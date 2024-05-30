import { redirect } from "@remix-run/node";

/** We dont render anything on /settings
 * We just redirect to default subroute which is user
 */
export function loader() {
  return redirect("overview");
}

export const shouldRevalidate = () => false;
