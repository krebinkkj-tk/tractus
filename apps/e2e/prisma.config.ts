import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: 'postgresql://tractus:tractus_password@localhost:5432/tractus_e2e?schema=public',
  },
});
