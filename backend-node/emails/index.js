module.exports = {
  triggerNewOnboarding:         require("./triggers/triggerNewOnboarding"),
  triggerUpdateOnboarding:      require("./triggers/triggerUpdateOnboarding"),
  triggerWeeklyOnboardingEmail: require("./triggers/triggerWeeklyOnboardingEmail"),
  triggerWeeklyHREmail:         require("./triggers/triggerWeeklyHREmail"),
  triggerCandidateApplication:  require("./triggers/triggerCandidateApplication"),
  triggerNewExit:               require("./triggers/triggerExit").triggerNewExit,
  triggerUpdateExit:            require("./triggers/triggerExit").triggerUpdateExit,
};