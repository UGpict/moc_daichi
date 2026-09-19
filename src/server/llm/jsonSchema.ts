import { z, type ZodType } from "zod";

function strictify(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const schema = node as Record<string, unknown>;
  if (schema.properties && typeof schema.properties === "object") {
    schema.additionalProperties = false;
    const props = schema.properties as Record<string, unknown>;
    const required = new Set([
      ...((schema.required as string[] | undefined) ?? []),
      ...Object.keys(props),
    ]);
    schema.required = [...required];
    for (const key of Object.keys(props)) props[key] = strictify(props[key]);
  }
  if (schema.items) schema.items = strictify(schema.items);
  if (Array.isArray(schema.anyOf)) schema.anyOf = schema.anyOf.map(strictify);
  if (Array.isArray(schema.oneOf)) schema.oneOf = schema.oneOf.map(strictify);
  if (schema.$defs && typeof schema.$defs === "object") {
    const defs = schema.$defs as Record<string, unknown>;
    for (const key of Object.keys(defs)) defs[key] = strictify(defs[key]);
  }
  return schema;
}

export function toOpenAiJsonSchema(name: string, schema: ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema) as Record<string, unknown>;
  delete raw.$schema;
  return {
    type: "json_schema",
    json_schema: {
      name: name.slice(0, 64),
      strict: true,
      schema: strictify(raw),
    },
  };
}
