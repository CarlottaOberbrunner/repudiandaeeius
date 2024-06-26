const VAR_PREFIX = '@@VAR@@'
const VAR_PREFIX_LENGTH = VAR_PREFIX.length

export function jsonToGraphQLQuery({
  kind,
  name,
  jsonQuery,
  typesTree,
}: {
  kind: 'query' | 'mutation'
  name: string
  jsonQuery: any
  typesTree: any
}) {
  const variablesData = {} as any

  extractVariables({
    jsonQuery: { [name]: jsonQuery },
    variables: variablesData,
    parentType: kind === 'query' ? typesTree.Query : typesTree.Mutation,
  })

  const variablesQuery = Object.keys(variablesData).length
    ? `(${Object.entries(variablesData)
        .map(([name, { type }]: any) => `$${name}: ${type}`)
        .join(', ')})`
    : ''

  const query = `${kind} ${name}${variablesQuery} { ${name}${toGraphql(jsonQuery)} }`
  const variables = Object.fromEntries(Object.entries(variablesData).map(([k, v]: any) => [k, v.value]))

  return {
    query,
    variables,
  }
}

function extractVariables({ jsonQuery, variables, parentType }: { jsonQuery: any; variables: any; parentType: any }) {
  if (!parentType) return

  if (jsonQuery.__args) {
    Object.keys(jsonQuery.__args).forEach(k => {
      if (typeof jsonQuery.__args[k] === 'string' && jsonQuery.__args[k].startsWith(VAR_PREFIX)) return

      const variableName = `${k}_${Math.random()
        .toString(36)
        .substr(2, 4)}`

      if (jsonQuery.__args[k] !== undefined) {
        variables[variableName] = {
          type: parentType.__args[k],
          value: jsonQuery.__args[k],
        }
        jsonQuery.__args[k] = `${VAR_PREFIX}$${variableName}`
      }
    })
  }

  Object.keys(jsonQuery)
    .filter(k => k !== '__args' && typeof jsonQuery[k] === 'object')
    .forEach(k =>
      extractVariables({
        jsonQuery: jsonQuery[k],
        variables,
        parentType: parentType.hasOwnProperty(k) ? parentType[k] : parentType.__fields ? parentType.__fields[k] : undefined,
      })
    )
}

function toGraphql(jsonQuery: any) {
  const fields = Object.entries(jsonQuery)
    .filter(([k, v]) => k !== '__args' && v !== false && v !== undefined)
    .map(([k, v]) => (typeof v === 'object' ? `${k}${toGraphql(v)}` : k))
    .join(' ') as any

  const validArgs = jsonQuery.__args ? Object.entries(jsonQuery.__args).filter(([_, v]) => v !== undefined) : []
  const argsQuery = validArgs.length ? `(${validArgs.map(([k, v]: any) => `${k}:${v.substr(VAR_PREFIX_LENGTH)}`).join(',')})` : ''

  return `${argsQuery} ${fields ? `{ ${fields} }` : ''}`
}
