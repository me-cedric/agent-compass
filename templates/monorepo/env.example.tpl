# SonarQube Configuration
# Copy this file to .env and fill in your values
# NEVER commit .env file to git (it's already in .gitignore)

# SonarQube authentication token
# Generate via: pnpm sonar:setup (automatic)
# Or manually: User → My Account → Security → Generate Token in SonarQube UI
SONAR_TOKEN=your_sonar_token_here

# EV Charging / Freshmile / OCPI Feature Flag
# When disabled (default), all EV charging endpoints, webhooks, processors,
# and side effects are dormant. Set to 'true', '1', or 'yes' to enable.
EV_CHARGING_ENABLED=false
