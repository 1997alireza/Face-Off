class Perturbation {
  constructor(data) {
    this.data = data;
  }

  getDelta(x, y, c) {
    return this.data[x][y][c];
  }
}

async function fetchPerturbation(height, width) {
  var url = new URL('http://127.0.0.1:5000/perturbation/');
  url.search = new URLSearchParams({
    height: height,
    width: width
  });

  return await new Promise((resolve, reject) => {
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP error, status = ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        resolve(new Perturbation(data));
      })
  });
}