package ai.adflow.api.store.launch;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/campaign-launches")
public class CampaignLaunchController extends StoreController<CampaignLaunch> {

  public CampaignLaunchController(CampaignLaunchRepository repository) {
    super(repository);
  }
}
