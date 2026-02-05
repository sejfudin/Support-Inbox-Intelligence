import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";

export function usePageHeader(node, deps = []) {
  const { setHeader } = useOutletContext();

  useEffect(() => {
    setHeader(node);
    return () => setHeader(null);
  }, deps);
}
