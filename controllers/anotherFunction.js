exports.getFieldType = (schemaFields, fieldPath) => {
  const paths = fieldPath.split(".");
  let currentField = schemaFields;

  for (const path of paths) {
    if (!currentField[path]) {
      return null;
    }

    // หากเจอ subdocument
    if (currentField[path].schema) {
      currentField = currentField[path].schema.paths;
    } else {
      currentField = currentField[path];
    }
  }

  return currentField.instance || null;
};
