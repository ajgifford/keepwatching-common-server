export function filterUSOrEnglishShows(shows: any[]) {
  return shows.filter((show) => {
    const isUSOrigin = show.origin_country.includes('US');
    const isEnglishLanguage = show.original_language === 'en';

    return isUSOrigin || (!isUSOrigin && isEnglishLanguage);
  });
}
