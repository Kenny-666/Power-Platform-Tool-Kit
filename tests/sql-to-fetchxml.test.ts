import { convertSqlToFetchXml } from '#content/modules/sql-to-fetchxml';

describe('convertSqlToFetchXml', () => {
  it('converts a SELECT query with filtering, sorting, and a result limit', () => {
    const result = convertSqlToFetchXml(
      "SELECT TOP 100 name, accountnumber FROM account WHERE statecode = 0 AND name LIKE 'Contoso%' ORDER BY name DESC"
    );

    expect(result).toEqual({
      entityName: 'account',
      fetchXml:
        '<fetch top="100"><entity name="account"><attribute name="name" /><attribute name="accountnumber" /><filter type="and"><condition attribute="statecode" operator="eq" value="0" /><condition attribute="name" operator="like" value="Contoso%" /></filter><order attribute="name" descending="true" /></entity></fetch>',
    });
  });

  it('converts IN and NULL conditions', () => {
    const result = convertSqlToFetchXml(
      "SELECT name FROM contact WHERE statuscode IN (1, 2) OR parentcustomerid IS NULL"
    );

    expect(result.fetchXml).toBe(
      '<fetch><entity name="contact"><attribute name="name" /><filter type="or"><condition attribute="statuscode" operator="in"><value>1</value><value>2</value></condition><condition attribute="parentcustomerid" operator="null" /></filter></entity></fetch>'
    );
  });

  it.each([
    'UPDATE account SET name = \'Contoso\'',
    'SELECT * FROM account',
    'SELECT name FROM account; DELETE FROM account',
    'SELECT name FROM account WHERE statecode = 0 AND name = \'Contoso\' OR accountnumber = \'1\'',
  ])('rejects unsupported SQL: %s', sql => {
    expect(() => convertSqlToFetchXml(sql)).toThrow();
  });
});
