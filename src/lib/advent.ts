/**
 * Advent: the Gospel readings that open each week of Darrell W. Johnson's "Awaken Wonder:
 * Daily Devotions for Advent". The references come from the excerpts he shares himself,
 * one for each week. The devotions are the author's and the publisher's, and belong in the
 * book: the page is there to send people to it. So it holds references, links and one short
 * snippet a week, word for word from what he already gives away, and never more.
 *
 * The book's days between one Sunday and the next aren't public, so the page keeps to
 * weeks rather than guess at them.
 */
const SITE = 'https://www.darrelljohnson.ca/articles';

export const ADVENT = {
  book: 'Awaken Wonder: Daily Devotions for Advent',
  author: 'Darrell W. Johnson',
  // The link on his own site.
  buy: 'https://www.amazon.ca/dp/B0FQNZ8P9R',
  weeks: [
    { name: 'Week One', readings: ['Luke 1:26-56'], snippet: 'Mary dared to believe that the Living God could do what had never been done before, and she invites us to do the same.', excerpt: `${SITE}/awaken-wonder-week-1` },
    { name: 'Week Two', readings: ['Luke 1:1-25', 'Luke 1:57-80', 'Matthew 1:1-17'], snippet: 'The God of Christmas is the passionate God, who sympathizes and empathizes, who feels our hurts and longings and fears.', excerpt: `${SITE}/advent-week-2-a-gift-from-awaken-wonder` },
    { name: 'Week Three', readings: ['Matthew 1:18-25', 'Luke 2:1-21'], snippet: 'In fact, Joseph does not say anything at all in the Christmas story! Yet, like many gentle, quiet types, his actions speak volumes.', excerpt: `${SITE}/advent-week-3-a-gift-from-awaken-wonder` },
    { name: 'Week Four', readings: ['Luke 2:22-40', 'Matthew 2:1-23', 'Luke 2:41-52'], snippet: 'It is so easy to go through the Christmas season and miss the point of it. One person who got it was a man named Simeon.', excerpt: `${SITE}/advent-week-4-a-gift-from-awaken-wonder` },
  ],
};

/** The first Sunday of Advent: the fourth Sunday before Christmas Day. */
export function adventStart(year: number): Date {
  const christmas = new Date(year, 11, 25);
  // A Christmas on a Sunday doesn't count as one of the four.
  const back = christmas.getDay() || 7;
  return new Date(year, 11, 25 - back - 21);
}

/** The year whose Advent to show: this one's until Christmas Day, then the next. */
export const seasonYear = (now: Date) => (now >= new Date(now.getFullYear(), 11, 25) ? now.getFullYear() + 1 : now.getFullYear());

/** Which week of Advent it is (0 to 3), or null outside the season. */
export function adventWeek(now: Date): number | null {
  const year = now.getFullYear();
  const start = adventStart(year);
  if (now < start || now >= new Date(year, 11, 25)) return null;
  const midnight = new Date(year, now.getMonth(), now.getDate());
  // Days counted by the calendar, so a clock change in the season can't shift a week.
  const days = Math.round((midnight.getTime() - start.getTime()) / 86_400_000);
  return Math.min(3, Math.floor(days / 7));
}

/** The Sunday each week begins, in the given year. */
export const weekStart = (year: number, week: number) => {
  const start = adventStart(year);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7);
};
