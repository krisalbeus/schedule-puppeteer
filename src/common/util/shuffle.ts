const random = (seed: number) => {
  const x = Math.sin(seed++) * 10_000;
  return x - Math.floor(x);
};

export const shuffle = (array: any[], seed: number) => {
  let m = array.length;
  let t, i;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(random(seed) * m--); // <-- MODIFIED LINE

    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
    ++seed; // <-- ADDED LINE
  }

  return array;
};
