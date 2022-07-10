import InitDal from '../../../db/impl/init-dal';

/**
 * poor man's approach to 're-initializing' the local db.  
 * 
 * run manually to reset entire db (remember to remove '.skip' !)
 * node 'node_modules/.bin/jest' './src/services/test/manual-integrations/db-init-integration-test.ts' -t 'run local db init'
 */
test.skip('run local db init', async () => {
    const create = new InitDal();
    await create.createTables();
})


