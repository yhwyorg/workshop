import { useEffect } from 'react';

export default function About() {
  useEffect(() => {
    document.title = 'About · Sermon Workshop';
  }, []);
  return (
    <article className="paper about">
      <p className="soli">Soli Deo gloria</p>
      <h1 className="hand">About the workshop</h1>
      <p>
        A place to work on a passage the way a preacher does at the desk: read it slowly, mark what you see, ask your
        questions, and build toward a sermon, on a pad that looks and feels like the yellow legal pads many of us
        still reach for.
      </p>
      <p>
        It was made for Darrell W. Johnson, who has spent a lifetime preaching from the text, and for any pastor or
        reader who wants a quiet place to do the same. Its companion is{' '}
        <a href="https://gospels.yhwh.rest/">Gospel Parallels</a>, the four Gospels side by side.
      </p>
      <h2>Where your pads are kept</h2>
      <p>
        On this device, in this browser, and nowhere else: nothing you write is sent anywhere. That also means a pad
        made on your laptop is not on your iPad, and clearing this site’s data in the browser deletes your pads. Use{' '}
        <strong>Export</strong> on a pad to keep a copy you can open anywhere.
      </p>
      <h2>Skins</h2>
      <p>
        Skins are plain descriptions of colors and paper, checked before use. They cannot contain code or load anything
        from the internet, so a skin cannot see or send your notes.
      </p>
      <h2>The text</h2>
      <p>
        Scripture is from the <a href="https://worldenglish.bible/">World English Bible</a> (public domain), taken
        unchanged from <a href="https://ebible.org/">eBible.org</a>.
      </p>
    </article>
  );
}
