const LOGICAL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

interface SqlCondition {
  attribute: string;
  operator: string;
  values?: string[];
}

interface SqlOrder {
  attribute: string;
  descending: boolean;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, character => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[character];
  });
}

function assertLogicalName(value: string, description: string): string {
  if (!LOGICAL_NAME_PATTERN.test(value)) {
    throw new Error(`Invalid ${description}: ${value}`);
  }
  return value;
}

function splitOutsideQuotes(value: string, separator: string): string[] {
  const results: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenthesisDepth = 0;

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (quote) {
      if (character === quote) {
        if (quote === "'" && value[index + 1] === "'") {
          index++;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '(') {
      parenthesisDepth++;
    } else if (character === ')') {
      parenthesisDepth--;
      if (parenthesisDepth < 0) {
        throw new Error('Unbalanced parentheses in SQL query');
      }
    } else if (
      parenthesisDepth === 0 &&
      value.slice(index, index + separator.length).toUpperCase() === separator.toUpperCase()
    ) {
      results.push(value.slice(start, index).trim());
      start = index + separator.length;
      index += separator.length - 1;
    }
  }

  if (quote || parenthesisDepth !== 0) {
    throw new Error('Unterminated string or parentheses in SQL query');
  }
  results.push(value.slice(start).trim());
  return results;
}

function parseSqlValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed) || /^(true|false)$/i.test(trimmed)) {
    return trimmed;
  }
  throw new Error(`Unsupported SQL value: ${value}`);
}

function parseCondition(expression: string): SqlCondition {
  const isNullMatch = /^(\w+)\s+IS\s+(NOT\s+)?NULL$/i.exec(expression);
  if (isNullMatch) {
    return {
      attribute: assertLogicalName(isNullMatch[1], 'field name'),
      operator: isNullMatch[2] ? 'not-null' : 'null',
    };
  }

  const inMatch = /^(\w+)\s+(NOT\s+)?IN\s*\((.*)\)$/i.exec(expression);
  if (inMatch) {
    const values = splitOutsideQuotes(inMatch[3], ',').map(parseSqlValue);
    if (values.length === 0 || values.some(value => !value)) {
      throw new Error('IN requires at least one value');
    }
    return {
      attribute: assertLogicalName(inMatch[1], 'field name'),
      operator: inMatch[2] ? 'not-in' : 'in',
      values,
    };
  }

  const comparisonMatch = /^(\w+)\s*(=|<>|!=|>=|<=|>|<|NOT\s+LIKE|LIKE)\s*(.+)$/i.exec(expression);
  if (!comparisonMatch) {
    throw new Error(`Unsupported WHERE condition: ${expression}`);
  }

  const operatorMap: Record<string, string> = {
    '=': 'eq',
    '<>': 'ne',
    '!=': 'ne',
    '>': 'gt',
    '>=': 'ge',
    '<': 'lt',
    '<=': 'le',
    LIKE: 'like',
    'NOT LIKE': 'not-like',
  };
  const sqlOperator = comparisonMatch[2].replace(/\s+/g, ' ').toUpperCase();
  return {
    attribute: assertLogicalName(comparisonMatch[1], 'field name'),
    operator: operatorMap[sqlOperator],
    values: [parseSqlValue(comparisonMatch[3])],
  };
}

function parseWhereClause(whereClause: string): { type: 'and' | 'or'; conditions: SqlCondition[] } {
  const hasAnd = /\s+AND\s+/i.test(whereClause);
  const hasOr = /\s+OR\s+/i.test(whereClause);
  if (hasAnd && hasOr) {
    throw new Error('Mixing AND and OR in one WHERE clause is not supported');
  }

  const separator = hasAnd ? 'AND' : hasOr ? 'OR' : null;
  const expressions = separator
    ? splitOutsideQuotes(whereClause, ` ${separator} `)
    : [whereClause.trim()];
  if (expressions.some(expression => !expression)) {
    throw new Error('WHERE clause contains an empty condition');
  }

  return {
    type: hasOr ? 'or' : 'and',
    conditions: expressions.map(parseCondition),
  };
}

function renderCondition(condition: SqlCondition): string {
  const attribute = escapeXml(condition.attribute);
  if (!condition.values) {
    return `<condition attribute="${attribute}" operator="${condition.operator}" />`;
  }
  if (condition.values.length === 1) {
    return `<condition attribute="${attribute}" operator="${condition.operator}" value="${escapeXml(condition.values[0])}" />`;
  }
  const values = condition.values.map(value => `<value>${escapeXml(value)}</value>`).join('');
  return `<condition attribute="${attribute}" operator="${condition.operator}">${values}</condition>`;
}

/** Converts a limited, read-only SQL SELECT query into Dataverse FetchXML. */
export function convertSqlToFetchXml(sql: string): { entityName: string; fetchXml: string } {
  const normalizedSql = sql.trim().replace(/;\s*$/, '');
  if (!normalizedSql || /;/.test(normalizedSql)) {
    throw new Error('Enter one SQL SELECT statement without semicolons');
  }

  const queryMatch = /^SELECT\s+(?:(?:TOP\s*\(?\s*(\d+)\s*\)?\s+))?(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+))?$/i.exec(normalizedSql);
  if (!queryMatch) {
    throw new Error('Only SELECT queries with FROM are supported');
  }

  const [, topValue, selectClause, entityNameValue, whereClause, orderByClause] = queryMatch;
  const entityName = assertLogicalName(entityNameValue, 'table name');
  if (selectClause.trim() === '*') {
    throw new Error('SELECT * is not supported; specify logical field names');
  }

  const attributes = splitOutsideQuotes(selectClause, ',').map(attribute =>
    assertLogicalName(attribute.trim(), 'field name')
  );
  if (attributes.length === 0 || attributes.some(attribute => !attribute)) {
    throw new Error('SELECT must specify at least one field');
  }

  const orders: SqlOrder[] = orderByClause
    ? splitOutsideQuotes(orderByClause, ',').map(order => {
        const match = /^(\w+)(?:\s+(ASC|DESC))?$/i.exec(order);
        if (!match) {
          throw new Error(`Unsupported ORDER BY expression: ${order}`);
        }
        return {
          attribute: assertLogicalName(match[1], 'field name'),
          descending: match[2]?.toUpperCase() === 'DESC',
        };
      })
    : [];
  const filter = whereClause ? parseWhereClause(whereClause) : null;
  const top = topValue ? Number(topValue) : undefined;
  if (top !== undefined && (!Number.isSafeInteger(top) || top < 1 || top > 5000)) {
    throw new Error('TOP must be between 1 and 5000');
  }

  const topAttribute = top ? ` top="${top}"` : '';
  const attributeXml = attributes.map(attribute => `<attribute name="${escapeXml(attribute)}" />`).join('');
  const filterXml = filter
    ? `<filter type="${filter.type}">${filter.conditions.map(renderCondition).join('')}</filter>`
    : '';
  const orderXml = orders
    .map(order => `<order attribute="${escapeXml(order.attribute)}" descending="${order.descending}" />`)
    .join('');

  return {
    entityName,
    fetchXml: `<fetch${topAttribute}><entity name="${escapeXml(entityName)}">${attributeXml}${filterXml}${orderXml}</entity></fetch>`,
  };
}
