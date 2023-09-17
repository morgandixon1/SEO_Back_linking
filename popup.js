const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "A", "this", "to", "was", "will", "with"
]);

let cache = {};

function tokenizeText(text) {
  if (!text) {
    return [];
  }
  return text.toString().toLowerCase().match(/\b(\w+)\b/g);
}
function excludeUrl(url) {
  const excludedExtensions = ['.atom'];
  for (const ext of excludedExtensions) {
    if (url.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

function hasMinimumLength(word, minLength = 3) {
  return word.length >= minLength;
}

function isStopWord(word) {
  return stopWords.has(word.toLowerCase());
}

function generateNGrams(words, n) {
  const ngrams = [];
  for (let i = 0; i < words.length - n + 1; i++) {
    ngrams.push(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

function extractKeywords(inputText, maxN = 3) {
  if (cache.hasOwnProperty(inputText)) {
    return cache[inputText];
  }

  let words = tokenizeText(inputText);

  let tf = {};
  let df = {};

  for (let n = 1; n <= maxN; n++) {
    const ngrams = generateNGrams(words, n);
    ngrams.forEach(gram => {
      const tokens = gram.split(" ");
      if (tokens.every(token => !isStopWord(token)) && tokens.some(token => hasMinimumLength(token))) {
        tf[gram] = (tf[gram] || 0) + 1;
      }
    });
  }

  let docLength = words.length;

  Object.keys(tf).forEach(keyword => {
    df[keyword] = 1;

    let tfidf = tf[keyword] * Math.log(docLength / df[keyword]);
    tf[keyword] = tfidf;
  });

  let sortedKeywords = Object.entries(tf).sort((a, b) => b[1] - a[1]);
  let numKeywords = Math.min(Math.ceil(docLength / 100), sortedKeywords.length);
  let result = sortedKeywords.slice(0, numKeywords).map(entry => entry[0]);

  cache[inputText] = result;
  return result;
}


document.addEventListener("DOMContentLoaded", function () {
  const extractButton = document.querySelector("#extractButton");
  const urlInput = document.querySelector("#urlInput");

  if (extractButton && urlInput) {
    extractButton.addEventListener("click", function () {
      console.log("Extract text button clicked");
      const url = urlInput.value;

      if (!url) {
        console.log("URL is empty");
        return;
      }

      const textInput = document.querySelector("#output").innerText;
      const topics = extractKeywords(textInput);

      crawlWebsite(url)
        .then((pages) => {
          console.log(pages);
          const result = { urlInput: url, textInput: pages[0].content };
          console.log(result);
          linkTopics(textInput, topics, pages);
        })
        .catch((error) => {
          console.log("Error crawling website:", error);
        });
    });
  }
});

async function crawlWebsite(url) {
  const MAX_PAGES = 10; // maximum number of pages to crawl
  const urls = new Set();
  const visited = new Set();
  const pages = [];
  const queue = [url];
  const inputUrlOrigin = new URL(url).origin;
  function enqueue(url) {
    if (urls.size < MAX_PAGES && !urls.has(url) && !visited.has(url) && !excludeUrl(url)) {
      urls.add(url);
      visited.add(url);
      queue.push(url);
    }
  }

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const currentUrl = queue.shift();
    const response = await fetch(currentUrl).catch(() => null);
    if (!response) {
      continue;
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html.replace(/\s{2,}/g, ''), 'text/html'); // Remove extra white space

    const results = [];

    const links = Array.from(doc.querySelectorAll('a[href]')); // Select all anchor tags with an href attribute
    links.forEach((link) => {
      const href = link.getAttribute('href').trim();
      if (href.startsWith("/") || href.startsWith(inputUrlOrigin)) {
        const absoluteUrl = new URL(href, inputUrlOrigin).href; // Convert relative or same-origin URL to absolute URL
        console.log('Found href:', href); // Debugging: Print the found href
        if (!urls.has(absoluteUrl)) {
          enqueue(absoluteUrl);
        }
      }
    });

    const content = doc.querySelector('body') ? doc.querySelector('body').textContent : doc.documentElement.textContent; // Get the text content of the main body of the page
    pages.push({ url: currentUrl, content: content, doc: doc });
    console.log(`Page crawled: ${currentUrl}`);
  }
  return pages;
}

function bagOfWords(words) {
  let bag = {};
  for (let word of words) {
    if (bag.hasOwnProperty(word)) {
      bag[word]++;
    } else {
      bag[word] = 1;
    }
  }
  return bag;
}
function bm25Similarity(keywords, docText) {
  const k1 = 1.2;
  const b = 0.75;
  const avgDocLength = 300;
  const numDocs = 10;
  const docLength = docText.length;
  const docWords = tokenizeText(docText);

  let score = 0;

  for (let i = 0; i < keywords.length; i++) {
    let keyword = keywords[i];
    let tf = 0;
    let numDocsContainingTerm = 0;

    for (let j = 0; j < docWords.length; j++) {
      let docWord = docWords[j];
      if (docWord === keyword) {
        tf++;
      }
    }

    if (tf > 0) {
      numDocsContainingTerm++;
    }

    let idf = Math.log((numDocs - numDocsContainingTerm + 0.5) / (numDocsContainingTerm + 0.5));

    let numerator = idf * tf * (k1 + 1);
    let denominator = tf + k1 * (1 - b + b * docLength / avgDocLength);

    score += numerator / denominator;
  }

  return score;
}
function linkTopics(inputText, topics, pages) {
  let bestMatches = new Map();
  let uniqueKeywords = new Set();

  // Loop through each topic and find the best matching page
  topics.forEach((keyword) => {
    let bestMatch = null;
    let maxScore = 0;
    pages.forEach((page) => {
      const score = bm25Similarity(extractKeywords(page.content), keyword);
      if (score > maxScore) {
        maxScore = score;
        bestMatch = page;
      }
    });
    if (bestMatch) {
      bestMatches.set(keyword, {url: bestMatch.url, score: maxScore});
      uniqueKeywords.add(keyword);
    }
  });

  const paragraphs = inputText.split('\n').filter(paragraph => paragraph.trim().length > 0);
  const startBodyIndex = Math.floor(paragraphs.length * 0.25);
  const endBodyIndex = Math.floor(paragraphs.length * 0.75);

  const linkCountPerParagraph = Math.floor(uniqueKeywords.size / 2); // Change the divisor to a lower number
  const linkCount = Math.min(Math.max(linkCountPerParagraph, 1), 5);

  const modifiedParagraphs = paragraphs.map((paragraph, index) => {
    if (index >= startBodyIndex && index < endBodyIndex) {
      let modifiedParagraph = paragraph;
      let count = 0;

      bestMatches.forEach((match, keyword) => {
        if (count < linkCount) {
          const hyperlink = `<a href="${match.url}" target="_blank">${keyword}</a>`;
          modifiedParagraph = modifiedParagraph.replace(new RegExp(`\\b${keyword}\\b`, 'mi'), hyperlink);
          count++;
        }
      });

      return modifiedParagraph;
    } else {
      return paragraph;
    }
  });

  let modifiedText = modifiedParagraphs.join('\n');
  document.querySelector("#output").innerHTML = modifiedText.replace(/\n/g, '<br>');

  // Log the best matches for each keyword
  console.log("Best matches for each keyword:");
  bestMatches.forEach((match, keyword) => {
    console.log(`Keyword: '${keyword}', URL: '${match.url}', Score: ${match.score}`);
  });

  // Add the return statement here
  return modifiedText;
}
