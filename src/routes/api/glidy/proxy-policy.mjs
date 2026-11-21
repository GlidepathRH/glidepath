export function isAllowedGlidyReadPath(path) {
  return (
    path === "ready" ||
    path === "api/v1/indexer" ||
    path === "api/v1/launches" ||
    /^api\/v1\/launches\/0x[0-9a-fA-F]{40}(?:\/(?:events|chart))?$/.test(path)
  );
}

export function isAllowedGlidyImageUploadPath(path) {
  return /^api\/v1\/launches\/0x[0-9a-fA-F]{40}\/image$/.test(path);
}
