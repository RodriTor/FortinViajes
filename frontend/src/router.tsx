import { AnchorHTMLAttributes, useEffect, useState } from "react";

const current = () => (window.location.hash.replace(/^#/, "") || "/").split("?")[0];

export function useRoute(): string {
  const [route, setRoute] = useState(current());
  useEffect(() => {
    const onChange = () => { setRoute(current()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const navigate = (path: string) => { window.location.hash = path; };

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={`#${to}`} {...rest} />;
}
