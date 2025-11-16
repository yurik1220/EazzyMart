const sql = require('mssql/msnodesqlv8');

const config = {
  server: 'KIRIGAMEKAZUTO\\SQLEXPRESS',
  database: 'grocery',
  options: {
    trustedConnection: true,
    enableArithAbort: true
  },
  driver: 'ODBC Driver 17 for SQL Server'
};

module.exports = {
  sql,
  config
};