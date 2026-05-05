function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function stringifyNormalized(value: unknown): string {
  return JSON.stringify(value) ?? 'undefined';
}

function normalizeForJson(value: unknown, stack = new WeakSet<object>()): unknown {
  if (value === null) {
    return value;
  }

  if (typeof value === 'bigint') {
    return { $type: 'bigint', value: value.toString() };
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { $type: 'number', value: String(value) };
  }

  if (typeof value === 'undefined') {
    return { $type: 'undefined' };
  }

  if (typeof value === 'symbol') {
    return { $type: 'symbol', value: value.description ?? value.toString() };
  }

  if (typeof value === 'function') {
    return { $type: 'function', value: value.name || 'anonymous' };
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (stack.has(value)) {
    throw new TypeError('Cannot stringify circular value');
  }

  stack.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeForJson(item, stack));
    }

    if (value instanceof Date) {
      return {
        $type: 'Date',
        value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString(),
      };
    }

    if (value instanceof RegExp) {
      return { $type: 'RegExp', source: value.source, flags: value.flags };
    }

    if (value instanceof Map) {
      const entries = Array.from(value.entries()).map(([key, item]) => [
        normalizeForJson(key, stack),
        normalizeForJson(item, stack),
      ]);

      entries.sort((left, right) =>
        compareStrings(stringifyNormalized(left[0]), stringifyNormalized(right[0]))
        || compareStrings(stringifyNormalized(left[1]), stringifyNormalized(right[1])),
      );

      return { $type: 'Map', value: entries };
    }

    if (value instanceof Set) {
      const values = Array.from(value.values()).map((item) => normalizeForJson(item, stack));

      values.sort((left, right) => compareStrings(stringifyNormalized(left), stringifyNormalized(right)));

      return { $type: 'Set', value: values };
    }

    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      sorted[key] = normalizeForJson(record[key], stack);
    }

    return sorted;
  } finally {
    stack.delete(value);
  }
}

function fallbackArgLabel(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `array:${value.length}`;
  }

  if (value instanceof Date) {
    return 'date';
  }

  if (value instanceof Map) {
    return `map:${value.size}`;
  }

  if (value instanceof Set) {
    return `set:${value.size}`;
  }

  return typeof value;
}

export function createCacheKey(path: string, args: unknown[]): string {
  try {
    return `${path}:${JSON.stringify(normalizeForJson(args))}`;
  } catch {
    return `${path}:unserializable:${args.map(fallbackArgLabel).join(',')}`;
  }
}
