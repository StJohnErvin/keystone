const { Keystone } = require('@keystone-next/keystone-legacy');
const { PasswordAuthStrategy } = require('@keystone-next/auth-password-legacy');
const { Text, Password, Select } = require('@keystone-next/fields-legacy');
const { GraphQLApp } = require('@keystone-next/app-graphql-legacy');
const { AdminUIApp } = require('@keystone-next/app-admin-ui-legacy');
const { objMerge } = require('@keystone-next/utils-legacy');
const {
  getStaticListName,
  getImperativeListName,
  getDeclarativeListName,
  getFieldName,
  listAccessVariations,
  fieldAccessVariations,
} = require('./cypress/integration/util');

const { projectName } = require('./config');

const { PrismaAdapter } = require('@keystone-next/adapter-prisma-legacy');

const keystone = new Keystone({
  adapter: new PrismaAdapter(),
  cookieSecret: 'qwerty',
});

keystone.createList('User', {
  fields: {
    email: {
      type: Text,
    },
    password: {
      type: Password,
      minLength: 2,
      workFactor: 4,
    },
    // Normally users might be multiple of each of these, but for demo purposes
    // we assume they can only be one at a time.
    level: {
      type: Select,
      options: ['su', 'admin', 'editor', 'writer', 'reader'],
    },
    // NOTE: We only need imperitive ones here - we test elsewhere that static
    // fields aren't included in graphQL responses. And fields can't have
    // declarative types.
    noRead: { type: Text, access: { read: () => false } },
    yesRead: { type: Text, access: { read: () => true } },
  },
});

const authStrategy = keystone.createAuthStrategy({
  type: PasswordAuthStrategy,
  list: 'User',
});

function createListWithStaticAccess(access) {
  const createField = fieldAccess => ({
    [getFieldName(fieldAccess)]: {
      type: Text,
      access: fieldAccess,
    },
  });
  keystone.createList(getStaticListName(access), {
    fields: {
      foo: { type: Text },
      zip: { type: Text },
      ...objMerge(fieldAccessVariations.map(variation => createField(variation))),
    },
    access,
  });
}

function createListWithImperativeAccess(access) {
  const createField = fieldAccess => ({
    [getFieldName(fieldAccess)]: {
      type: Text,
      access: {
        create: () => fieldAccess.create,
        read: () => fieldAccess.read,
        update: () => fieldAccess.update,
        delete: () => fieldAccess.delete,
      },
    },
  });
  keystone.createList(getImperativeListName(access), {
    fields: {
      foo: { type: Text },
      zip: { type: Text },
      ...objMerge(fieldAccessVariations.map(variation => createField(variation))),
    },
    access: {
      create: () => access.create,
      read: () => access.read,
      update: () => access.update,
      delete: () => access.delete,
      auth: () => access.auth,
    },
  });
}

function createListWithDeclarativeAccess(access) {
  keystone.createList(getDeclarativeListName(access), {
    fields: {
      foo: { type: Text },
      zip: { type: Text },
    },
    access: {
      create: ({ authentication: { item, listKey } }) =>
        access.create && listKey === 'User' && ['su', 'admin'].includes(item.level),
      read: ({ authentication: { item, listKey } }) => {
        if (access.read && listKey === 'User' && ['su', 'admin'].includes(item.level)) {
          return {
            // arbitrarily restrict the data to a single item (see data.js)
            foo_starts_with: 'Hello',
          };
        }
        return false;
      },
      update: ({ authentication: { item, listKey } }) => {
        if (access.update && listKey === 'User' && ['su', 'admin'].includes(item.level)) {
          return {
            // arbitrarily restrict the data to a single item (see data.js)
            foo_starts_with: 'Hello',
          };
        }
        return false;
      },
      delete: ({ authentication: { item, listKey } }) => {
        if (access.delete && listKey === 'User' && ['su', 'admin'].includes(item.level)) {
          return {
            // arbitrarily restrict the data to a single item (see data.js)
            foo_starts_with: 'Hello',
          };
        }
        return false;
      },
      auth: true,
    },
  });
}

listAccessVariations.forEach(createListWithStaticAccess);
listAccessVariations.forEach(createListWithImperativeAccess);
listAccessVariations.forEach(createListWithDeclarativeAccess);

module.exports = {
  keystone,
  apps: [
    new GraphQLApp(),
    new AdminUIApp({ name: projectName, adminPath: '/admin', authStrategy }),
  ],
};
