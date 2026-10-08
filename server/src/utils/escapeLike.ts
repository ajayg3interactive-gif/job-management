// Prisma does not escape LIKE wildcards in `contains` on MySQL, so "%" or "_" typed
// into a search box would match everything. Escape them so search is literal.
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
