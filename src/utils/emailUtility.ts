import { DigestEmail, DiscoveryEmail } from '../types/emailTypes';

/**
 * Generate HTML content for weekly digest email
 */
export function generateWeeklyDigestHTML(emailData: DigestEmail): string {
  const { accountName, profiles, weekRange } = emailData;

  let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Weekly Watch Guide</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .header { background-color: #1a1a1a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; margin: -20px -20px 20px -20px; }
        .profile-section { margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .profile-name { color: #1a1a1a; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        .content-section { margin-bottom: 20px; }
        .content-title { color: #555; font-size: 16px; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #007bff; padding-left: 10px; }
        .content-item { background-color: #f8f9fa; padding: 10px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid #007bff; }
        .content-item-title { font-weight: bold; color: #1a1a1a; }
        .content-item-details { font-size: 14px; color: #666; margin-top: 5px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        .no-content { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Your Weekly Watch Guide</h1>
            <p>Hi ${accountName}! Here's what's coming up from ${formatDate(weekRange.start)} to ${formatDate(weekRange.end)}</p>
        </div>
`;

  profiles.forEach((profile) => {
    html += `
        <div class="profile-section">
            <div class="profile-name">📺 ${profile.profile.name}'s Watchlist</div>
`;

    // Upcoming Episodes
    if (profile.upcomingEpisodes.length > 0) {
      html += `
            <div class="content-section">
                <div class="content-title">🆕 New Episodes This Week</div>
`;
      profile.upcomingEpisodes.forEach((episode) => {
        html += `
                <div class="content-item">
                    <div class="content-item-title">${episode.showName}</div>
                    <div class="content-item-details">
                        S${episode.seasonNumber}E${episode.episodeNumber}: ${episode.episodeTitle}<br>
                        Airs: ${formatDate(episode.airDate)}
                    </div>
                </div>
`;
      });
      html += `            </div>`;
    }

    // Upcoming Movies
    if (profile.upcomingMovies.length > 0) {
      html += `
            <div class="content-section">
                <div class="content-title">🎬 Movies Releasing This Week</div>
`;
      profile.upcomingMovies.forEach((movie) => {
        html += `
                <div class="content-item">
                    <div class="content-item-title">${movie.title}</div>
                </div>
`;
      });
      html += `            </div>`;
    }

    // Continue Watching
    if (profile.continueWatching.length > 0) {
      html += `
            <div class="content-section">
                <div class="content-title">⏭️ Continue Watching</div>
`;
      profile.continueWatching.forEach((show) => {
        html += `
                <div class="content-item">
                    <div class="content-item-title">${show.showTitle}</div>
                    <div class="content-item-details">
                        ${show.episodes.length > 0 ? `Next: S${show.episodes[0].seasonNumber}E${show.episodes[0].episodeNumber} - ${show.episodes[0].episodeTitle}` : 'Ready to continue'}
                    </div>
                </div>
`;
      });
      html += `            </div>`;
    }

    html += `        </div>`;
  });

  html += `
        <div class="footer">
            <p>Happy watching! 🍿</p>
            <p><small>This email was generated automatically by your KeepWatching system.</small></p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Generate plain text content for weekly digest email
 */
export function generateWeeklyDigestText(emailData: DigestEmail): string {
  const { accountName, profiles, weekRange } = emailData;

  let text = `Your Weekly Watch Guide\n`;
  text += `Hi ${accountName}! Here's what's coming up from ${formatDate(weekRange.start)} to ${formatDate(weekRange.end)}\n\n`;

  profiles.forEach((profile) => {
    text += `${profile.profile.name}'s Watchlist\n`;
    text += `${'='.repeat(profile.profile.name.length + 12)}\n\n`;

    if (profile.upcomingEpisodes.length > 0) {
      text += `New Episodes This Week:\n`;
      profile.upcomingEpisodes.forEach((episode) => {
        text += `• ${episode.showName} - S${episode.seasonNumber}E${episode.episodeNumber}: ${episode.episodeTitle}\n`;
        text += `  Airs: ${formatDate(episode.airDate)}\n`;
      });
      text += `\n`;
    }

    if (profile.upcomingMovies.length > 0) {
      text += `Movies Releasing This Week:\n`;
      profile.upcomingMovies.forEach((movie) => {
        text += `• ${movie.title}\n`;
      });
      text += `\n`;
    }

    if (profile.continueWatching.length > 0) {
      text += `Continue Watching:\n`;
      profile.continueWatching.forEach((show) => {
        text += `• ${show.showTitle}`;
        if (show.episodes.length > 0) {
          text += ` - Next: S${show.episodes[0].seasonNumber}E${show.episodes[0].episodeNumber} - ${show.episodes[0].episodeTitle}`;
        }
        text += `\n`;
      });
      text += `\n`;
    }

    text += `\n`;
  });

  text += `Happy watching!\n\n`;
  text += `This email was generated automatically by your KeepWatching system.`;

  return text;
}

/**
 * Generate HTML content for discovery email
 */
export function generateDiscoveryEmailHTML(emailData: DiscoveryEmail): string {
  const { accountName, data } = emailData;
  const { profiles, featuredContent } = data;

  let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discover Something New</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; margin: -20px -20px 20px -20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .intro-section { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea; }
        .intro-text { color: #555; font-size: 16px; margin: 0; }
        .profiles-section { margin-bottom: 25px; }
        .profiles-list { color: #667eea; font-weight: bold; }
        .content-section { margin-bottom: 25px; }
        .content-title { color: #333; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #667eea; padding-left: 15px; }
        .content-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; }
        .content-item { background: linear-gradient(145deg, #f1f3f4, #e8eaed); padding: 15px; border-radius: 8px; flex: 1; min-width: 250px; border: 1px solid #e0e0e0; transition: transform 0.2s; }
        .content-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .content-item-title { font-weight: bold; color: #333; margin-bottom: 5px; }
        .content-item-details { font-size: 14px; color: #666; }
        .cta-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
        .cta-title { color: white; font-size: 20px; font-weight: bold; margin-bottom: 10px; }
        .cta-text { color: white; opacity: 0.9; margin-bottom: 20px; }
        .cta-button { display: inline-block; background-color: white; color: #667eea; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; transition: transform 0.2s; }
        .cta-button:hover { transform: scale(1.05); }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        .empty-state { text-align: center; color: #666; font-style: italic; padding: 20px; }
        
        @media (max-width: 600px) {
            .content-grid { flex-direction: column; }
            .content-item { min-width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌟 Discover Something New!</h1>
            <p>Hi ${accountName}! Your watchlist is ready for some fresh content</p>
        </div>

        <div class="intro-section">
            <p class="intro-text">
                <strong>No upcoming episodes this week?</strong> Perfect time to discover your next binge-worthy obsession! 
                We've curated some trending content that might catch your interest.
            </p>
        </div>

        <div class="profiles-section">
            <p><strong>Ready to add to your profiles:</strong> 
                <span class="profiles-list">${profiles.map((p) => p.name).join(', ')}</span>
            </p>
        </div>
`;

  // Trending Shows
  if (featuredContent.trendingShows.length > 0) {
    html += `
        <div class="content-section">
            <div class="content-title">🔥 Trending Shows Everyone's Talking About</div>
            <div class="content-grid">
`;
    featuredContent.trendingShows.forEach((show) => {
      html += `
                <div class="content-item">
                    <div class="content-item-title">${show.title}</div>
                    <div class="content-item-details">Currently trending • Perfect for binge-watching</div>
                </div>
`;
    });
    html += `            </div>
        </div>`;
  }

  // New Releases
  if (featuredContent.newReleases.length > 0) {
    html += `
        <div class="content-section">
            <div class="content-title">✨ Fresh Releases</div>
            <div class="content-grid">
`;
    featuredContent.newReleases.forEach((item) => {
      html += `
                <div class="content-item">
                    <div class="content-item-title">${item.title}</div>
                    <div class="content-item-details">Recently released • Hot off the press</div>
                </div>
`;
    });
    html += `            </div>
        </div>`;
  }

  // Popular Movies
  if (featuredContent.popularMovies.length > 0) {
    html += `
        <div class="content-section">
            <div class="content-title">🎬 Popular Movies</div>
            <div class="content-grid">
`;
    featuredContent.popularMovies.forEach((movie) => {
      html += `
                <div class="content-item">
                    <div class="content-item-title">${movie.title}</div>
                    <div class="content-item-details">Highly rated • Audience favorite</div>
                </div>
`;
    });
    html += `            </div>
        </div>`;
  }

  // Call to Action
  html += `
        <div class="cta-section">
            <div class="cta-title">Ready to Explore?</div>
            <div class="cta-text">Log in to KeepWatching and add these to your watchlist!</div>
            <a href="https://keepwatching.giffordfamilydev.us/" class="cta-button">Browse Content →</a>
        </div>

        <div class="footer">
            <p>Happy discovering! 🎭</p>
            <p><small>This email was generated automatically by your KeepWatching system.<br>
            You're receiving this because you have no upcoming content this week.</small></p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Generate plain text content for discovery email
 */
export function generateDiscoveryEmailText(emailData: DiscoveryEmail): string {
  const { accountName, data } = emailData;
  const { profiles, featuredContent } = data;

  let text = `Discover Something New!\n`;
  text += `Hi ${accountName}! Your watchlist is ready for some fresh content\n\n`;

  text += `No upcoming episodes this week? Perfect time to discover your next binge-worthy obsession!\n`;
  text += `We've curated some trending content that might catch your interest.\n\n`;

  text += `Ready to add to your profiles: ${profiles.map((p) => p.name).join(', ')}\n\n`;

  if (featuredContent.trendingShows.length > 0) {
    text += `🔥 TRENDING SHOWS EVERYONE'S TALKING ABOUT:\n`;
    featuredContent.trendingShows.forEach((show) => {
      text += `• ${show.title} - Currently trending, perfect for binge-watching\n`;
    });
    text += `\n`;
  }

  if (featuredContent.newReleases.length > 0) {
    text += `✨ FRESH RELEASES:\n`;
    featuredContent.newReleases.forEach((item) => {
      text += `• ${item.title} - Recently released, hot off the press\n`;
    });
    text += `\n`;
  }

  if (featuredContent.popularMovies.length > 0) {
    text += `🎬 POPULAR MOVIES:\n`;
    featuredContent.popularMovies.forEach((movie) => {
      text += `• ${movie.title} - Highly rated, audience favorite\n`;
    });
    text += `\n`;
  }

  text += `READY TO EXPLORE?\n`;
  text += `Log in to KeepWatching and add these to your watchlist!\n\n`;

  text += `Happy discovering!\n\n`;
  text += `This email was generated automatically by your KeepWatching system.\n`;
  text += `You're receiving this because you have no upcoming content this week.`;

  return text;
}

/**
 * Get the date range for the upcoming week (next 7 days)
 */
export function getUpcomingWeekRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + 1); // Start tomorrow

  const end = new Date(start);
  end.setDate(start.getDate() + 6); // 7 days total

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
