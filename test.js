// test.js
const request = require('supertest');
const app = require('./server'); // using the exported Express app

async function runTests() {
  console.log('🧩 Starting String Analyzer API tests...\n');

  // 1️⃣ POST /strings
  console.log('→ Testing POST /strings...');
  let res = await request(app)
    .post('/strings')
    .send({ value: 'Madam' })
    .expect(201);

  console.log('✅ Created:', res.body.value, '\n');

  const createdId = res.body.id;

  // 2️⃣ POST duplicate (should return 409)
  console.log('→ Testing duplicate POST...');
  await request(app)
    .post('/strings')
    .send({ value: 'Madam' })
    .expect(409);
  console.log('✅ Duplicate detection passed\n');

  // 3️⃣ POST invalid (missing value)
  console.log('→ Testing invalid POST (missing value)...');
  await request(app)
    .post('/strings')
    .send({})
    .expect(400);
  console.log('✅ Missing value handled\n');

  // 4️⃣ POST invalid type
  console.log('→ Testing invalid POST (non-string)...');
  await request(app)
    .post('/strings')
    .send({ value: 123 })
    .expect(422);
  console.log('✅ Non-string handled\n');

  // 5️⃣ GET /strings/:stringValue
  console.log('→ Testing GET /strings/Madam...');
  res = await request(app).get('/strings/Madam').expect(200);
  console.log('✅ Retrieved string:', res.body.value, '\n');

  // 6️⃣ GET /strings (with filters)
  console.log('→ Testing GET /strings?is_palindrome=true...');
  res = await request(app).get('/strings?is_palindrome=true').expect(200);
  console.log('✅ Filtered count:', res.body.count, '\n');

  // 7️⃣ GET /strings/filter-by-natural-language
  console.log('→ Testing Natural Language Filter...');
  res = await request(app)
    .get('/strings/filter-by-natural-language')
    .query({ query: 'palindromic strings longer than 3' })
    .expect(200);
  console.log('✅ Natural language parsed:', res.body.interpreted_query, '\n');

  // 8️⃣ DELETE /strings/:stringValue
  console.log('→ Testing DELETE /strings/Madam...');
  await request(app).delete('/strings/Madam').expect(204);
  console.log('✅ Deletion successful\n');

  // 9️⃣ DELETE non-existent
  console.log('→ Testing DELETE non-existent string...');
  await request(app).delete('/strings/Madam').expect(404);
  console.log('✅ Non-existent deletion handled\n');

  console.log('🎉 All tests completed successfully!');
}

// Run tests
runTests().catch(err => {
  console.error('❌ Test run failed:', err.message);
  process.exit(1);
});
