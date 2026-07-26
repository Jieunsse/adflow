package ai.adflow.api.store.campaign;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/influencer-campaigns")
public class InfluencerCampaignController extends StoreController<InfluencerCampaign> {

  public InfluencerCampaignController(InfluencerCampaignRepository repository) {
    super(repository);
  }
}
