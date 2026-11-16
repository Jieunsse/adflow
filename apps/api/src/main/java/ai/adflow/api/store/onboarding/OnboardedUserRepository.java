package ai.adflow.api.store.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OnboardedUserRepository extends JpaRepository<OnboardedUser, String> {}
