import Ajv from 'ajv';

const locationEntrySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    date: { type: 'string' },
    end_date: { type: 'string' },
    region: { type: 'string' },
    place: { type: 'string' },
    notes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  }
};

const personSchema = {
  type: 'object',
  required: ['name', 'gender'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'object',
      required: ['given'],
      additionalProperties: false,
      properties: {
        given: { type: 'string', minLength: 1 },
        given_at_birth: { type: 'string' },
        preferred: { type: 'string' },
        middles: { type: 'array', items: { type: 'string' } },
        surnames: {
          type: 'object',
          additionalProperties: false,
          properties: {
            current: { type: 'string' },
            birth: { type: 'string' }
          }
        }
      }
    },
    gender: { type: 'string', enum: ['male', 'female'] },
    dob: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    dod: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    country_of_birth: { type: 'string' },
    locations: {
      type: 'object',
      additionalProperties: false,
      properties: {
        birth: locationEntrySchema,
        death: locationEntrySchema,
        other: {
          type: 'array',
          items: locationEntrySchema
        }
      }
    },
    deceased: { type: 'boolean' },
    profession: { type: 'string' },
    interesting_facts: { type: 'string' },
    titles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'type'],
        additionalProperties: false,
        properties: {
          value: { type: 'string' },
          type: { type: 'string', enum: ['noble', 'military', 'religious', 'academic', 'civic'] }
        }
      }
    },
    aliases: {
      type: 'array',
      items: { type: 'string' }
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'person'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['parent', 'partner'] },
          person: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          locations: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    research: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          sources: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    stories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
          places: { type: 'array', items: { type: 'string' } },
          dates: { type: 'array', items: { type: 'string' } },
          people: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true });
const compiledValidate = ajv.compile(personSchema);

export { personSchema };

/**
 * Validate a person object against the schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validate(data) {
  const valid = compiledValidate(data);
  if (valid) return { valid: true };
  const errors = compiledValidate.errors.map(
    (e) => `${e.instancePath || '/'} ${e.message}`
  );
  return { valid: false, errors };
}
