package ai.adflow.api.account;

import org.springframework.data.jpa.repository.JpaRepository;

interface ClientAccountRepository extends JpaRepository<ClientAccount, String> {}

interface EmailTokenRepository extends JpaRepository<EmailToken, String> {}
