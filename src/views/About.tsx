import { useEffect } from 'react';

export default function About() {
  useEffect(() => {
    document.title = 'About · Sermon Workshop';
  }, []);
  return (
    <article className="page-paper about">
      <p className="soli">Soli Deo gloria</p>
      <h1>About the workshop</h1>
      <p>
        A quiet desk for working on a passage the way a preacher does: the Bible open on one side, a yellow legal pad
        on the other. Read slowly, mark what you see, and write toward a sermon, by hand with a pen or with the keyboard.
      </p>
      <p>
        It was made for Darrell W. Johnson, who has spent a lifetime preaching from the text, and for any pastor or
        reader who wants a quiet place to do the same. Its companion is{' '}
        <a href="https://gospels.yhwh.rest/">Gospel Parallels</a>, the four Gospels side by side.
      </p>
      <h2>Where your studies are kept</h2>
      <p>
        On this device, in this browser, and nowhere else: nothing you write is sent anywhere. That also means a study
        begun on your laptop is not on your iPad, and clearing this site’s data in the browser deletes your studies. Use{' '}
        <strong>Save a copy</strong> in the menu to keep one you can open anywhere.
      </p>
      <h2>Paper</h2>
      <p>
        Paper styles are plain descriptions of colors, checked before use. They cannot contain code or load anything
        from the internet, so a paper style cannot see or send what you write.
      </p>
      <h2>The text</h2>
      <p>
        Scripture is from the <a href="https://worldenglish.bible/">World English Bible</a> (public domain), taken
        unchanged from <a href="https://ebible.org/">eBible.org</a>.
      </p>
      <p>
        The translations and commentaries under <strong>Compare</strong> come from the{' '}
        <a href="https://bible.helloao.org/">Free Use Bible API</a>, a chapter at a time. They are in the public domain,
        except the Tyndale Open Study Notes (© Tyndale House Publishers, CC BY-SA 4.0). Opening one asks that site for the
        chapter you are reading, so it can see which chapter that is; nothing you write goes with it.
      </p>
    </article>
  );
}
