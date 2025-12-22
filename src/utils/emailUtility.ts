import { DigestEmail, DiscoveryEmail, WelcomeEmail } from '../types/emailTypes';

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
 * Generate HTML content for welcome email
 */
export function generateWelcomeEmailHTML(emailData: WelcomeEmail): string {
  const { accountName, featuredContent } = emailData;

  let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to KeepWatching!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; margin: -20px -20px 20px -20px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 15px 0 0 0; opacity: 0.95; font-size: 18px; }
        .welcome-section { background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #667eea; }
        .welcome-text { color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 15px 0; }
        .features-section { margin-bottom: 30px; }
        .features-title { color: #333; font-size: 20px; font-weight: bold; margin-bottom: 15px; text-align: center; }
        .feature-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; justify-content: space-between; }
        .feature-item { background: linear-gradient(145deg, #f8f9fa, #e9ecef); padding: 20px; border-radius: 8px; flex: 0 0 calc(50% - 8px); border: 1px solid #e0e0e0; text-align: center; box-sizing: border-box; }
        .feature-icon { font-size: 32px; margin-bottom: 10px; }
        .feature-title { font-weight: bold; color: #333; margin-bottom: 8px; font-size: 16px; }
        .feature-description { font-size: 14px; color: #666; line-height: 1.5; }
        .content-section { margin-bottom: 25px; }
        .content-title { color: #333; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #667eea; padding-left: 15px; }
        .content-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; justify-content: space-between; }
        .content-item { background: linear-gradient(145deg, #f1f3f4, #e8eaed); padding: 15px; border-radius: 8px; flex: 0 0 100%; border: 1px solid #e0e0e0; box-sizing: border-box; }
        .content-item-title { font-weight: bold; color: #333; margin-bottom: 5px; }
        .content-item-details { font-size: 14px; color: #666; }
        .cta-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0; }
        .cta-title { color: white; font-size: 22px; font-weight: bold; margin-bottom: 15px; }
        .cta-text { color: white; opacity: 0.95; margin-bottom: 25px; font-size: 16px; }
        .cta-button { display: inline-block; background-color: white; color: #667eea; padding: 14px 35px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; transition: transform 0.2s; }
        .cta-button:hover { transform: scale(1.05); }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        
        @media (max-width: 600px) {
            .feature-grid, .content-grid { flex-direction: column; }
            .feature-item, .content-item { min-width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Welcome to KeepWatching!</h1>
            <p>Hi ${accountName}! We're excited to have you here</p>
        </div>

        <div class="welcome-section">
            <p class="welcome-text">
                <strong>Thank you for joining KeepWatching!</strong> Your personal entertainment hub is now ready. 
                We're here to help you track your favorite TV shows and movies, discover new content, and never miss an episode again.
            </p>
            <p class="welcome-text">
                Whether you're binge-watching the latest series or catching up on movies you've been meaning to see, 
                KeepWatching makes it easy to stay organized and up-to-date with all your entertainment.
            </p>
        </div>

        <div class="features-section">
            <div class="features-title">✨ What You Can Do</div>
            <div class="feature-grid">
                <div class="feature-item">
                    <div class="feature-icon">📺</div>
                    <div class="feature-title">Track Shows & Movies</div>
                    <div class="feature-description">Add your favorite content and mark episodes as watched</div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">🔔</div>
                    <div class="feature-title">Get Notifications</div>
                    <div class="feature-description">Never miss new episodes with weekly email digests</div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">👥</div>
                    <div class="feature-title">Multiple Profiles</div>
                    <div class="feature-description">Create profiles for family members with separate watchlists</div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">🔍</div>
                    <div class="feature-title">Discover Content</div>
                    <div class="feature-description">Explore trending shows and movies to add to your list</div>
                </div>
            </div>
        </div>
`;

  // Add featured content sections
  if (featuredContent.trendingShows.length > 0) {
    html += `
        <div class="content-section">
            <div class="content-title">🔥 Trending Shows to Get Started</div>
            <div class="content-grid">
`;
    featuredContent.trendingShows.slice(0, 3).forEach((show) => {
      html += `
                <div class="content-item">
                    <div class="content-item-title">${show.title}</div>
                    <div class="content-item-details">Currently trending</div>
                </div>
`;
    });
    html += `            </div>
        </div>`;
  }

  if (featuredContent.popularMovies.length > 0) {
    html += `
        <div class="content-section">
            <div class="content-title">🎬 Popular Movies</div>
            <div class="content-grid">
`;
    featuredContent.popularMovies.slice(0, 3).forEach((movie) => {
      html += `
                <div class="content-item">
                    <div class="content-item-title">${movie.title}</div>
                    <div class="content-item-details">Highly rated</div>
                </div>
`;
    });
    html += `            </div>
        </div>`;
  }

  html += `
        <div class="cta-section">
            <div class="cta-title">Ready to Start Watching?</div>
            <div class="cta-text">Log in now to create your profiles and build your watchlist!</div>
            <a href="https://keepwatching.giffordfamilydev.us/" class="cta-button">Get Started →</a>
        </div>

        <div class="footer">
            <p>Happy watching! 🍿</p>
            <p><small>Welcome to the KeepWatching community!<br>
            Questions? Just reply to this email.</small></p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Generate plain text content for welcome email
 */
export function generateWelcomeEmailText(emailData: WelcomeEmail): string {
  const { accountName, featuredContent } = emailData;

  let text = `Welcome to KeepWatching!\n`;
  text += `Hi ${accountName}! We're excited to have you here\n\n`;

  text += `THANK YOU FOR JOINING!\n`;
  text += `${'='.repeat(40)}\n\n`;

  text += `Your personal entertainment hub is now ready. We're here to help you track your favorite\n`;
  text += `TV shows and movies, discover new content, and never miss an episode again.\n\n`;

  text += `Whether you're binge-watching the latest series or catching up on movies you've been\n`;
  text += `meaning to see, KeepWatching makes it easy to stay organized and up-to-date with all\n`;
  text += `your entertainment.\n\n`;

  text += `WHAT YOU CAN DO:\n`;
  text += `${'='.repeat(40)}\n`;
  text += `📺 Track Shows & Movies - Add your favorites and mark episodes as watched\n`;
  text += `🔔 Get Notifications - Never miss new episodes with weekly email digests\n`;
  text += `👥 Multiple Profiles - Create profiles for family members with separate watchlists\n`;
  text += `🔍 Discover Content - Explore trending shows and movies to add to your list\n\n`;

  if (featuredContent.trendingShows.length > 0) {
    text += `🔥 TRENDING SHOWS TO GET STARTED:\n`;
    featuredContent.trendingShows.slice(0, 3).forEach((show) => {
      text += `• ${show.title} - Currently trending\n`;
    });
    text += `\n`;
  }

  if (featuredContent.popularMovies.length > 0) {
    text += `🎬 POPULAR MOVIES:\n`;
    featuredContent.popularMovies.slice(0, 3).forEach((movie) => {
      text += `• ${movie.title} - Highly rated\n`;
    });
    text += `\n`;
  }

  text += `READY TO START WATCHING?\n`;
  text += `Log in now to create your profiles and build your watchlist!\n`;
  text += `Visit: https://keepwatching.giffordfamilydev.us/\n\n`;

  text += `Happy watching!\n\n`;
  text += `Welcome to the KeepWatching community!\n`;
  text += `Questions? Just reply to this email.`;

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
 * Treats the date string as local date (not UTC) to avoid timezone shifts
 */
export function formatDate(dateString: string): string {
  // Extract just the date part if it includes time (ISO format with T)
  const datePart = dateString.split('T')[0];

  // Parse as local date by extracting year, month, day components
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
