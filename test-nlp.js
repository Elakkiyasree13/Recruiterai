import nlp from 'compromise';
console.log('NLP Type:', typeof nlp);
const doc = nlp('Hello world');
console.log('Test doc:', doc.text());
