package ai.adflow.api.client;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface ClientRepository extends OwnerScopedRepository<Client> {
  List<Client> findByStage(String stage);

  Optional<Client> findFirstByOwnerKeyAndBrandProfileId(String ownerKey, String brandProfileId);
}

interface ClientMemoRepository extends JpaRepository<ClientMemo, String> {
  List<ClientMemo> findByClientIdAndWorkspaceIdOrderByCreatedAtAsc(String clientId, String workspaceId);
}

interface ClientBillRepository extends JpaRepository<ClientBill, String> {
  List<ClientBill> findByClientIdAndWorkspaceIdOrderByContractMonthAsc(String clientId, String workspaceId);

  List<ClientBill> findByPaidDateIsNull();
}
